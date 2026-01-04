# Project Structure & Coding Guidelines

## Project Folder Structure

```
/project-root
├─ src
│  ├─ services           # All service functions (interact with DB/external APIs)
│  ├─ controllers        # All controller functions (business logic only)
│  ├─ routes             # All route definitions
│  ├─ middleware         # Middleware functions
│  ├─ utils              # Reusable utility/helper functions
│  ├─ types              # TypeScript type definitions & interfaces
│  ├─ constants          # All constant values & enums
│  ├─ config             # Configuration files (DB, environment variables, etc.)
│
├─ tests                 # Unit and integration tests (Jest, Supertest, etc.)
```

---

## General Principles

1. **Functional Approach Only**
   - Never mix class-based and function-based coding. Always use **functional programming style**.
   - Keep functions small, modular, and reusable.

2. **Types & Constants**
   - Never inline types or constants in your main code.
   - Always place them in the `types` or `constants` folder.
   - Organize types by feature or domain for clarity.

3. **Code Quality**
   - Avoid code duplication. Extract reusable logic into utilities or shared modules.
   - Optimize for readability and performance.
   - Write clean, modular code that follows **industry standards**.

4. **Latest Standards**
   - Follow **2025 TypeScript best practices**.
   - Refer to official documentation of libraries/packages you use.
   - Do **not** copy code from public repositories if it’s deprecated or incompatible.

5. **TypeScript & Linting**
   - Ensure **zero TypeScript errors** before committing.
   - Follow linting rules strictly.
   - Use type-safe patterns wherever possible.

6. **Testing**
   - Write unit tests when necessary.
   - Ensure critical functions and complex logic are well-tested.

7. **Comments**
   - Add concise, meaningful comments **inline or top-level** when necessary.
   - Avoid verbose or redundant comments.

---

## Summary

- Functional approach only
- Modular, optimized, deduplicated code
- Use `types` & `constants` folders
- Follow latest 2025 standards
- Type-safe & lint-free code
- Unit tests for critical code
- Concise, necessary comments
