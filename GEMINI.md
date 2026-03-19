# Development Guidelines

## Process for Code Changes

1. **Pre-development Setup:**
   - Read `architecture.md` to understand the software architecture
   - Read `codebase.md` to understand the codebase structure
   - Use `.env` for all configuration, never hardcode values

2. **During Development:**
   - Follow the established architecture patterns
   - Maintain consistency with existing codebase structure
   - Always use environment variables via `.env` file

3. **Post-development Tasks:**
   - Update `architecture.md` with any architectural changes
   - Update `codebase.md` with new codebase structure
   - Update `README.md` with relevant changes
   - Update `.env.example` if new environment variables are added
   - Update `.gitignore` if new files/directories need to be ignored
   - Update `.env` based on `.env.example` if needed

4. **Quality Assurance:**
   - Build the code to ensure no compilation errors
   - Run the code to verify functionality
   - Fix any errors until the application runs successfully
   - Kill any ports or shell processes after testing

## Key Principles

- **No hardcoding:** Always use environment variables
- **Documentation first:** Keep architecture and codebase docs current
- **Test thoroughly:** Build and run after every change
- **Clean resources:** Properly close ports and processes after testing