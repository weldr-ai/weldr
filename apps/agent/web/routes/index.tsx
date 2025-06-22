import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { createFileRoute } from "@tanstack/react-router";
import { Trash } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/")({
  component: Index,
});

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

function Index() {
  const [todos, setTodos] = useState&lt;Todo[]&gt;([]);
  const [newTodoText, setNewTodoText] = useState("");

  const handleAddTodo = () => {
    if (newTodoText.trim()) {
      setTodos([
        ...todos,
        { id: Date.now(), text: newTodoText, completed: false },
      ]);
      setNewTodoText("");
    }
  };

  const handleToggleTodo = (id: number) => {
    setTodos(
      todos.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  };

  const handleDeleteTodo = (id: number) => {
    setTodos(todos.filter((todo) => todo.id !== id));
  };

  return (
    &lt;div className="flex justify-center items-center min-h-screen"&gt;
      &lt;Card className="w-full max-w-md"&gt;
        &lt;CardHeader&gt;
          &lt;CardTitle&gt;Todo App&lt;/CardTitle&gt;
        &lt;/CardHeader&gt;
        &lt;CardContent&gt;
          &lt;div className="flex gap-2 mb-4"&gt;
            &lt;Input
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' &amp;&amp; handleAddTodo()}
              placeholder="Add a new task..."
            /&gt;
            &lt;Button onClick={handleAddTodo}&gt;Add&lt;/Button&gt;
          &lt;/div&gt;
          &lt;ul className="space-y-2"&gt;
            {todos.map((todo) => (
              &lt;li
                key={todo.id}
                className="flex items-center gap-2 p-2 rounded-md"
              &gt;
                &lt;Checkbox
                  checked={todo.completed}
                  onCheckedChange={() => handleToggleTodo(todo.id)}
                  id={`todo-${todo.id}`}
                /&gt;
                &lt;label
                  htmlFor={`todo-${todo.id}`}
                  className={`flex-grow ${
                    todo.completed ? "line-through text-muted-foreground" : ""
                  }`}
                &gt;
                  {todo.text}
                &lt;/label&gt;
                &lt;Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteTodo(todo.id)}
                &gt;
                  &lt;Trash className="h-4 w-4" /&gt;
                &lt;/Button&gt;
              &lt;/li&gt;
            ))}
          &lt;/ul&gt;
        &lt;/CardContent&gt;
      &lt;/Card&gt;
    &lt;/div&gt;
  );
}