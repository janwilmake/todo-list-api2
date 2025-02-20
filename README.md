# Matrix-Style Todo List

A unique todo list application with a Matrix-inspired theme, built using Cloudflare Workers and Durable Objects. This application provides a sleek, cyberpunk interface for managing your tasks with real-time persistence.

## Features

- Create, read, update, and delete todos
- Matrix-inspired design with green-on-black theme
- Falling animation effects
- Persistent storage using Durable Objects
- Per-IP state isolation
- Responsive design using Tailwind CSS

## Technical Stack

- Cloudflare Workers for serverless execution
- Durable Objects for state management
- Tailwind CSS for styling
- Matrix-inspired animations

## API Endpoints

### GET /todos
Returns all todos for the current IP

### POST /todos
Creates a new todo
```json
{
  "text": "Todo text"
}