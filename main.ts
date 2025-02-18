interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

export class TodoListDO implements DurableObject {
  private todos: Map<string, Todo> = new Map();

  constructor(private state: DurableObjectState) {
    // Load stored todos on initialization
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<Map<string, Todo>>("todos");
      if (stored) {
        this.todos = stored;
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    try {
      if (method === "POST" && url.pathname === "/todos") {
        const data = await request.json<{ text: string }>();
        if (!data.text) {
          return new Response("Text is required", { status: 400 });
        }

        const todo: Todo = {
          id: crypto.randomUUID(),
          text: data.text,
          completed: false,
          createdAt: Date.now(),
        };

        this.todos.set(todo.id, todo);
        await this.state.storage.put("todos", this.todos);
        return Response.json(todo);
      }

      if (method === "GET" && url.pathname === "/todos") {
        return Response.json(Array.from(this.todos.values()));
      }

      if (method === "PATCH" && url.pathname.startsWith("/todos/")) {
        const id = url.pathname.split("/")[2];
        const todo = this.todos.get(id);

        if (!todo) {
          return new Response("Todo not found", { status: 404 });
        }

        const data = await request.json<{ completed: boolean }>();
        todo.completed = data.completed;
        this.todos.set(id, todo);
        await this.state.storage.put("todos", this.todos);
        return Response.json(todo);
      }

      if (method === "DELETE" && url.pathname.startsWith("/todos/")) {
        const id = url.pathname.split("/")[2];
        const deleted = this.todos.delete(id);

        if (!deleted) {
          return new Response("Todo not found", { status: 404 });
        }

        await this.state.storage.put("todos", this.todos);
        return new Response(null, { status: 204 });
      }

      return new Response("Not found", { status: 404 });
    } catch (error) {
      console.error("Error:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  }
}

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    try {
      if (request.method === "GET" && !request.url.includes("/todos")) {
        return new Response(HTML, {
          headers: {
            "content-type": "text/html;charset=UTF-8",
          },
        });
      }

      const id = env.TODO_LIST.idFromName("default");
      const todoList = env.TODO_LIST.get(id);
      return await todoList.fetch(request);
    } catch (error) {
      console.error("Error:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
};

const HTML = `
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Matrix Todo List</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @keyframes matrix-rain {
            0% { transform: translateY(-100%); }
            100% { transform: translateY(100%); }
        }
        .matrix-bg::before {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(0deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 100%);
            pointer-events: none;
            z-index: -1;
        }
    </style>
</head>
<body class="bg-black text-green-500 min-h-screen matrix-bg">
    <div class="container mx-auto px-4 py-8">
        <h1 class="text-4xl font-mono mb-8 text-center">System Task Interface</h1>
        
        <div class="max-w-md mx-auto bg-black/50 p-6 rounded-lg border border-green-500">
            <div class="mb-4">
                <input type="text" id="new-todo" 
                       class="w-full bg-black border border-green-500 text-green-500 p-2 rounded 
                              focus:outline-none focus:ring-2 focus:ring-green-500 font-mono"
                       placeholder="Enter new task...">
            </div>
            
            <div id="todo-list" class="space-y-2">
                <!-- Todo items will be inserted here -->
            </div>
        </div>
    </div>

    <script>
        const todoList = document.getElementById('todo-list');
        const newTodoInput = document.getElementById('new-todo');

        async function loadTodos() {
            const response = await fetch('/todos');
            const todos = await response.json();
            renderTodos(todos);
        }

        function renderTodos(todos) {
            todoList.innerHTML = '';
            todos.sort((a, b) => b.createdAt - a.createdAt).forEach(todo => {
                const div = document.createElement('div');
                div.className = 'flex items-center p-2 border border-green-500/30 rounded font-mono ' + 
                              (todo.completed ? 'bg-green-900/20' : 'bg-black/50');
                div.innerHTML = \`
                    <input type="checkbox" \${todo.completed ? 'checked' : ''} 
                           class="mr-2 accent-green-500"
                           onchange="toggleTodo('\${todo.id}', this.checked)">
                    <span class="\${todo.completed ? 'line-through' : ''}">\${todo.text}</span>
                    <button onclick="deleteTodo('\${todo.id}')" 
                            class="ml-auto text-red-500 hover:text-red-400">×</button>
                \`;
                todoList.appendChild(div);
            });
        }

        newTodoInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter' && newTodoInput.value.trim()) {
                const response = await fetch('/todos', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({text: newTodoInput.value.trim()})
                });
                if (response.ok) {
                    newTodoInput.value = '';
                    loadTodos();
                }
            }
        });

        async function toggleTodo(id, completed) {
            const response = await fetch(\`/todos/\${id}\`, {
                method: 'PATCH',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({completed})
            });
            if (response.ok) {
                loadTodos();
            }
        }

        async function deleteTodo(id) {
            const response = await fetch(\`/todos/\${id}\`, {
                method: 'DELETE'
            });
            if (response.ok) {
                loadTodos();
            }
        }

        loadTodos();
    </script>
</body>
</html>
`;