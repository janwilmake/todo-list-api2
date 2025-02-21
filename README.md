# Matrix Todo List

A Matrix-themed todo list application built with Cloudflare Workers and Durable Objects. The application features a sleek, Matrix-inspired design with green-on-black color scheme and dynamic glow effects.

## Features

- Create, read, update, and delete todos
- Matrix-themed interface with glow animations
- Persistent storage using Durable Objects
- Per-IP state isolation (each IP address has its own todo list)
- Responsive design using Tailwind CSS

## Technical Stack

- Cloudflare Workers for serverless execution
- Durable Objects for state management
- Tailwind CSS for styling
- Matrix-inspired animations and effects

## API Endpoints

### GET /todos
Returns all todos for the current IP

### POST /todos
Creates a new todo
```json
{
  "text": "Todo text"
}