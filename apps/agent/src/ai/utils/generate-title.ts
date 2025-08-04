import { generateText } from "ai";

import { registry } from "./registry";

export async function generateProjectTitle(input: string) {
  const { text } = await generateText({
    system: `You are a helpful assistant that generates concise, professional project titles.

RULES:
- Generate ONLY the title, no extra text or explanation
- Maximum 3-4 words
- Use Title Case (capitalize each major word)
- Be specific and descriptive
- No articles (a, an, the) unless absolutely necessary
- No punctuation at the end

EXAMPLES:
Input: "I want to build a todo application with user authentication"
Output: Todo App

Input: "Create a dashboard for managing customers and their orders"
Output: Customer Dashboard

Input: "Build an e-commerce store for selling books online"
Output: Book Store

Input: "Make a blog website where users can post articles"
Output: Blog Platform

Input: "Create a chat application for team communication"
Output: Team Chat

Input: "Build a project management tool with kanban boards"
Output: Project Manager

Input: "Make a weather app that shows forecasts"
Output: Weather App

Input: "Create an expense tracker for personal finance"
Output: Expense Tracker`,
    model: registry.languageModel("google:gemini-2.5-flash"),
    prompt: `Generate a title for the following project: ${input}`,
    maxOutputTokens: 20,
  });
  return text.trim();
}
