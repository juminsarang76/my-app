'use client'

import { useEffect, useState } from 'react'

type Todo = {
  id: number
  title: string
  is_done: boolean
  created_at: string
}

export default function Home() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [title, setTitle] = useState('')

  const fetchTodos = async () => {
    const res = await fetch('/api/todos')
    const data = await res.json()
    setTodos(data)
  }

  const addTodo = async () => {
    if (!title.trim()) return
    await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    setTitle('')
    fetchTodos()
  }

  const toggleTodo = async (id: number, is_done: boolean) => {
    await fetch('/api/todos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_done: !is_done }),
    })
    fetchTodos()
  }

  const deleteTodo = async (id: number) => {
    await fetch('/api/todos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    fetchTodos()
  }

  useEffect(() => {
    fetchTodos()
  }, [])

  return (
    <div style={{ maxWidth: 480, margin: '60px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 24, fontWeight: 500, marginBottom: 24 }}>할 일 목록</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTodo()}
          placeholder="할 일을 입력하세요"
          style={{ flex: 1, padding: '8px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }}
        />
        <button
          onClick={addTodo}
          style={{ padding: '8px 16px', background: '#1D9E75', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}
        >
          추가
        </button>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {todos.map((todo) => (
          <li
            key={todo.id}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', border: '1px solid #eee', borderRadius: 8 }}
          >
            <input
              type="checkbox"
              checked={todo.is_done}
              onChange={() => toggleTodo(todo.id, todo.is_done)}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            <span
              style={{ flex: 1, fontSize: 14, textDecoration: todo.is_done ? 'line-through' : 'none', color: todo.is_done ? '#aaa' : '#000' }}
            >
              {todo.title}
            </span>
            <button
              onClick={() => deleteTodo(todo.id)}
              style={{ padding: '4px 10px', background: 'white', color: '#E24B4A', border: '1px solid #E24B4A', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
            >
              삭제
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}