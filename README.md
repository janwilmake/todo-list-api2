# Rainbow Todo List

A beautiful and functional todo list application with a rainbow theme, built using Cloudflare Workers and Durable Objects.

## Features

- Create, read, update, and delete todos
- Rainbow-themed interface with smooth animations
- Persistent storage using Durable Objects
- Per-IP state isolation (each IP address has its own todo list)
- Responsive design using Tailwind CSS

## Technical Stack

- Cloudflare Workers for serverless execution
- Durable Objects for state management
- Tailwind CSS for styling
- Rainbow gradient animations

## API Endpoints

### GET /todos
Returns all todos for the current IP

### POST /todos
Creates a new todo
```json
{
  "text": "Todo text"
}