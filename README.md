# Matrix-Style Todo List

A cyberpunk-themed todo list application built with Cloudflare Workers and Durable Objects. The application features a matrix-inspired design with a sleek, terminal-like interface.

## Features

- Create, read, update, and delete todos
- Persistent storage using Durable Objects
- Matrix-style user interface with green-on-black theme
- Responsive design using Tailwind CSS
- Real-time updates
- Per-IP state isolation

## API Endpoints

### GET /todos
Returns all todos for the current IP

### POST /todos
Creates a new todo
```json
{
  "text": "Todo text"
}