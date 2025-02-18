interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

export class TodoListDO implements DurableObject {
  private todos: Map<string, Todo> = new Map();

  constructor(private state: DurableObjectState, private env: any) {
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
      // Create new todo
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

        const data = await request.json<{ completed: boolean }>();
        todo.completed = data.completed;
        this.todos.set(id, todo);
        await this.state.storage.put("todos", this.todos);

        return Response.json(todo);
      }

      // Delete todo
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
      // Handle static files
      if (request.method === "GET" && !request.url.includes("/todos")) {
        // Serve index.html for root path
        const response = new Response(HTML, {
          headers: {
            "content-type": "text/html;charset=UTF-8",
          },
        });
        return response;
      }

      // Forward all API requests to the Durable Object
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
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Todo List</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        .todo-item {
            display: flex;
            align-items: center;
            padding: 10px;
            border-bottom: 1px solid #eee;
        }
        .todo-item.completed {
            text-decoration: line-through;
            color: #888;
        }
        .delete-btn {
            color: red;
            margin-left: auto;
            cursor: pointer;
        }
        #new-todo {
            width: 100%;
            padding: 10px;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <h1>Todo List</h1>
    <input type="text" id="new-todo" placeholder="Add new todo">
    <div id="todo-list"></div>

    <script>
        const todoList = document.getElementById('todo-list');
        const newTodoInput = document.getElementById('new-todo');

        // Load todos
        async function loadTodos() {
            const response = await fetch('/todos');
            const todos = await response.json();
            renderTodos(todos);
        }

        // Render todos
        function renderTodos(todos) {
            todoList.innerHTML = '';
            todos.sort((a, b) => b.createdAt - a.createdAt).forEach(todo => {
                const div = document.createElement('div');
                div.className = 'todo-item' + (todo.completed ? ' completed' : '');
                div.innerHTML = \`
                    <input type="checkbox" \${todo.completed ? 'checked' : ''} onchange="toggleTodo('\${todo.id}', this.checked)">
                    <span>\${todo.text}</span>
                    <span class="delete-btn" onclick="deleteTodo('\${todo.id}')">×</span>
                \`;
                todoList.appendChild(div);
            });
        }

        // Add new todo
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

        // Toggle todo status
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

        // Delete todo
        async function deleteTodo(id) {
            const response = await fetch(\`/todos/\${id}\`, {
                method: 'DELETE'
            });
            if (response.ok) {
                loadTodos();
            }
        }

        // Initial load
        loadTodos();
    </script>
</body>
</html>
`;