# Contributing to Quark Browser Agent

Thank you for your interest in contributing to Quark Browser Agent! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Respect different viewpoints and experiences

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Git
- Chrome browser (for testing)
- OpenRouter API key (for testing AI features)

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/your-username/quark-browser-agent.git
   cd quark-browser-agent
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the extension**
   ```bash
   npm run build
   ```

4. **Load in Chrome**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

5. **Start development server** (optional, for hot reload)
   ```bash
   npm run dev
   ```

## Development Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `test/description` - Test additions/updates

### Making Changes

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clean, readable code
   - Follow existing code style
   - Add comments for complex logic
   - Update documentation as needed

3. **Test your changes**
   - Test in Chrome with the extension loaded
   - Test on different websites
   - Verify error handling
   - Check for console errors

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add keyboard shortcuts"
   ```

   Use conventional commit messages:
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation
   - `style:` - Formatting, missing semicolons, etc.
   - `refactor:` - Code restructuring
   - `test:` - Adding tests
   - `chore:` - Maintenance tasks

5. **Push and create a Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```

## Project Structure

```
src/
├── background/        # Service worker (background scripts)
│   ├── agent.ts      # Agentic loop and orchestration
│   ├── tools.ts      # Tool definitions and executor
│   └── index.ts      # Main background script
├── content/          # Content scripts (injected into pages)
│   ├── element-picker.ts
│   ├── snapshot-capture.ts
│   └── dom-analyzer.ts
├── sidepanel/        # React UI
│   ├── components/   # React components
│   └── hooks/        # Custom React hooks
├── shared/           # Shared utilities and types
└── lib/              # Library functions (AI, prompts, etc.)
```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Define proper types and interfaces
- Avoid `any` - use `unknown` if type is truly unknown
- Use meaningful variable and function names

### React Components

- Use functional components with hooks
- Keep components small and focused
- Extract reusable logic into custom hooks
- Use TypeScript for props: `interface ComponentProps { ... }`

### Code Style

- Use 2 spaces for indentation
- Use single quotes for strings (unless escaping)
- Use trailing commas in multi-line objects/arrays
- Add semicolons
- Maximum line length: 100 characters

### Chrome Extension APIs

- Always handle errors from Chrome APIs
- Check for `chrome.runtime.lastError`
- Use async/await for Chrome API calls
- Document required permissions in code comments

## Testing

### Manual Testing Checklist

Before submitting a PR, test:

- [ ] Extension loads without errors
- [ ] Feature works on multiple websites
- [ ] No console errors or warnings
- [ ] Works with different AI models (if applicable)
- [ ] Error handling works correctly
- [ ] UI is responsive and accessible
- [ ] Scripts persist after extension reload

### Writing Tests

When adding tests:

1. Create test files alongside source files: `*.test.ts`
2. Use descriptive test names
3. Test both success and error cases
4. Mock Chrome APIs appropriately
5. Aim for >80% code coverage on new code

## Pull Request Process

### Before Submitting

1. **Update documentation** if you changed functionality
2. **Add tests** for new features or bug fixes
3. **Ensure all tests pass**
4. **Update CHANGELOG.md** (if it exists) with your changes
5. **Rebase on main** to ensure your branch is up to date

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How was this tested?

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests added/updated
```

### Review Process

- Maintainers will review your PR
- Address any feedback or requested changes
- Once approved, your PR will be merged
- Thank you for contributing!

## Good First Issues

Look for issues labeled `good first issue` if you're new to the project. These are:

- Well-documented with clear requirements
- Scoped appropriately for newcomers
- Include implementation notes
- Have acceptance criteria

## Areas for Contribution

### Code

- Bug fixes
- New features
- Performance improvements
- Code refactoring
- Test coverage

### Documentation

- README improvements
- Code comments
- API documentation
- Tutorials and guides
- Example scripts

### Design

- UI/UX improvements
- Accessibility enhancements
- Icon and logo updates
- Design system improvements

### Community

- Answer questions in issues
- Review pull requests
- Suggest improvements
- Share use cases and examples

## Getting Help

- **Issues**: Open an issue for bugs or feature requests
- **Discussions**: Use GitHub Discussions for questions
- **Documentation**: Check the README and code comments

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Project documentation

Thank you for helping make Quark Browser Agent better!

