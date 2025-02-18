# Todo List API

A simple todo list application built with Cloudflare Workers and Durable Objects.

## Features

- Create new todos
- List all todos
- Toggle todo completion status
- Delete todos
- Persistent storage using Durable Objects
- Simple web interface

## API Endpoints

### GET /todos
Returns a list of all todos

### POST /todos
Creates a new todo
```json
{
  "text": "Todo text"
}