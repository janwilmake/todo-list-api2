# Elegant Todo List API

A simple and elegant todo list application built with Cloudflare Workers and Durable Objects. This application provides a clean, minimalist interface for managing todos with real-time persistence.

## Features

- Create, read, update, and delete todos
- Elegant black and white design
- Persistent storage using Durable Objects
- Per-IP state isolation
- Responsive design using Tailwind CSS

## API Endpoints

### GET /todos
Returns all todos for the current IP

### POST /todos
Creates a new todo
```json
{
  "text": "Todo text"
}