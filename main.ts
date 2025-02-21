interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

export class TodoDO implements DurableObject {
  private todos: Map<string, Todo> = new Map();

  constructor(private state: DurableObjectState) {
    // Initialize stored todos
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<Map<string, Todo>>("todos");
      if (stored) this.todos = stored;
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    try {
      // Create todo
      if (method === "POST" && url.pathname === "/todos") {
        const data = await request.json<{ text: string }>();
        if (!data.text?.trim()) {
          return new Response("Text is required", { status: 400 });
        }

        const todo: Todo = {
          id: crypto.randomUUID(),
          text: data.text.trim(),
          completed: false,
          createdAt: Date.now(),
        };

        this.todos.set(todo.id, todo);
        await this.state.storage.put("todos", this.todos);
        return Response.json(todo);
      }

      // Get all todos
      if (method === "GET" && url.pathname === "/todos") {
        return Response.json(Array.from(this.todos.values()));
      }

      // Update todo status
      if (method === "PATCH" && url.pathname.startsWith("/todos/")) {
        const id = url.pathname.split("/")[2];
        const todo = this.todos.get(id);
        if (!todo) {
          return new Response("Todo not found", { status: 404 });
        }

        const data = await request.json<{ completed?: boolean }>();
        if (typeof data.completed === "boolean") {
          todo.completed = data.completed;
          this.todos.set(id, todo);
          await this.state.storage.put("todos", this.todos);
        }

        return Response.json(todo);
      }

      // Delete todo
      if (method === "DELETE" && url.pathname.startsWith("/todos/")) {
        const id = url.pathname.split("/")[2];
        if (!this.todos.delete(id)) {
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
      // Serve static frontend
      if (request.method === "GET" && !request.url.includes("/todos")) {
        return new Response(HTML, {
          headers: { "content-type": "text/html;charset=UTF-8" },
        });
      }

      // Route API requests to DO
      const id = env.TODO_DO.idFromName(request.headers.get("CF-Connecting-IP") || "default");
      const todo = env.TODO_DO.get(id);
      return await todo.fetch(request);
    } catch (error) {
      console.error("Error:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
};

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Matrix Todo List</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @keyframes matrix-effect {
            0% { text-shadow: 0 0 1px #0f0; }
            50% { text-shadow: 0 0 8px #0f0; }
            100% { text-shadow: 0 0 1px #0f0; }
        }
        .matrix-bg {
            background-color: #000;
            color: #0f0;
            font-family: 'Courier New', monospace;
        }
        .matrix-text {
            animation: matrix-effect 2s infinite;
            color: #0f0;
        }
        .matrix-input {
            background-color: #000;
            color: #0f0;
            border: 1px solid #0f0;
        }
        .matrix-input:focus {
            box-shadow: 0 0 10px #0f0;
            outline: none;
        }
        .matrix-button {
            transition: all 0.3s ease;
        }
        .matrix-button:hover {
            text-shadow: 0 0 8px #0f0;
            box-shadow: 0 0 10px #0f0;
        }
    </style>
</head>
<body class="matrix-bg min-h-screen p-8">
    <div class="container mx-auto max-w-2xl">
        <h1 class="text-4xl font-bold text-center mb-8 matrix-text">The Matrix Todo List</h1>
        
        <div class="mb-8">
            <input type="text" id="new-todo" 
                   class="matrix-input w-full px-4 py-2 rounded"
                   placeholder="Enter the matrix...">
        </div>
        
        <div id="todo-list" class="space-y-4">
            <!-- Todos will be inserted here -->
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
                div.className = 'matrix-button flex items-center p-4 border border-green-500 rounded ' + 
                              (todo.completed ? 'opacity-50' : '');
                div.innerHTML = \`
                    <input type="checkbox" \${todo.completed ? 'checked' : ''} 
                           class="h-5 w-5 matrix-input"
                           onchange="toggleTodo('\${todo.id}', this.checked)">
                    <span class="ml-3 flex-grow \${todo.completed ? 'line-through' : ''}">\${todo.text}</span>
                    <button onclick="deleteTodo('\${todo.id}')" 
                            class="ml-2 matrix-button px-2 py-1 border border-green-500 rounded">
                        Delete
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
            if (response.ok) loadTodos();
        }

        async function deleteTodo(id) {
            const response = await fetch(\`/todos/\${id}\`, {
                method: 'DELETE'
            });
            if (response.ok) loadTodos();
        }

        loadTodos();
    </script>
</body>
</html>`;