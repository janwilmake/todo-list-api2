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

      const id = env.TODO_LIST.idFromName(request.headers.get("CF-Connecting-IP") || "default");
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
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rainbow Todo List</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .rainbow-bg {
            background: linear-gradient(45deg, 
                #ff0000, #ff7300, #fffb00, #48ff00, 
                #00ffd5, #002bff, #7a00ff, #ff00c8);
            background-size: 800% 800%;
            animation: rainbow 8s ease infinite;
        }
        
        @keyframes rainbow {
            0% { background-position: 0% 50% }
            50% { background-position: 100% 50% }
            100% { background-position: 0% 50% }
        }
        
        .todo-item {
            transition: all 0.3s ease;
        }
        
        .todo-item:hover {
            transform: translateX(10px);
        }
    </style>
</head>
<body class="min-h-screen bg-gray-100">
    <div class="container mx-auto px-4 py-8">
        <div class="rainbow-bg text-white p-8 rounded-lg shadow-lg text-center mb-8">
            <h1 class="text-4xl font-bold">Rainbow Todo List</h1>
            <p class="mt-2">Organize your tasks with style! ✨</p>
        </div>
        
        <div class="bg-white rounded-lg shadow-lg p-6">
            <div class="mb-4">
                <input type="text" id="new-todo" 
                       class="w-full px-4 py-2 rounded-lg border-2 border-purple-300 focus:outline-none focus:border-purple-500"
                       placeholder="Add a new task...">
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
                div.className = 'todo-item flex items-center p-4 bg-white border rounded-lg shadow hover:shadow-md transition-all ' + 
                              (todo.completed ? 'bg-gray-50' : '');
                div.innerHTML = \`
                    <input type="checkbox" \${todo.completed ? 'checked' : ''} 
                           class="h-5 w-5 text-purple-600 rounded focus:ring-purple-500"
                           onchange="toggleTodo('\${todo.id}', this.checked)">
                    <span class="ml-3 flex-grow \${todo.completed ? 'line-through text-gray-500' : ''}">\${todo.text}</span>
                    <button onclick="deleteTodo('\${todo.id}')" 
                            class="ml-2 text-red-500 hover:text-red-700">
                        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
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