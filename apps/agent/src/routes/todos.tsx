import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { createFileRoute } from "@tanstack/react-router";
import { Trash } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/todos")({
  component: Todos,
});

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

function Todos() {
  const [todos, setTodos] = useState&lt;Todo[]&gt;([]);
  const [newTodo, setNewTodo] = useState("");

  const addTodo = () => {
    if (newTodo.trim() !== "") {
      setTodos([
        ...todos,
        { id: Date.now(), text: newTodo, completed: false },
      ]);
      setNewTodo("");
    }
  };

  const toggleTodo = (id: number) => {
    setTodos(
      todos.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  };

  const deleteTodo = (id: number) => {
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
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' &amp;&amp; addTodo()}
              placeholder="Add a new task..."
            /&gt;
            &lt;Button onClick={addTodo}&gt;Add&lt;/Button&gt;
          &lt;/div&gt;
          &lt;ul className="space-y-2"&gt;
            {todos.map((todo) => (
              &lt;li
                key={todo.id}
                className="flex items-center gap-2 p-2 rounded-md"
              &gt;
                &lt;Checkbox
                  checked={todo.completed}
                  onCheckedChange={() => toggleTodo(todo.id)}
                /&gt;
                &lt;span
                  className={`flex-grow ${
                    todo.completed ? "line-through text-muted-foreground" : ""
                  }`}
                &gt;
                  {todo.text}
                &lt;/span&gt;
                &lt;Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteTodo(todo.id)}
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