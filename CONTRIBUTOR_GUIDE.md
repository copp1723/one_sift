# Contributor Guide

## Dev Environment Tips

### Quick Navigation & Setup
- Use `npm run dev` to start the development server with hot reload
- Use `npm run worker:dev` to start the background worker with hot reload  
- Run `npm run dev:full` to start both API server and worker concurrently
- Use `npm run db:setup` to initialize the database with all migrations and seed data
- Check `package.json` scripts section for all available commands

### Database Management
- Run `npm run db:generate` to generate new migration files from schema changes
- Use `npm run db:migrate` to apply pending migrations
- Run `npm run db:seed` to populate the database with test data
- Use `npm run db:push` for development schema synchronization (non-production only)

### Environment Configuration
- Copy `.env.example` to `.env` and fill in your values
- Ensure all required environment variables are set before starting
- Use different `.env` files for different environments (dev, test, staging)
- Never commit actual `.env` files to version control

## Testing Instructions

### Running Tests
- Run `npm test` to execute the full test suite
- Use `npm run test:unit` to run only unit tests
- Use `npm run test:integration` to run only integration tests
- Run `npm run test:watch` for continuous testing during development
- Use `npm run test:coverage` to generate coverage reports

### Test Organization
- Unit tests go in `tests/unit/` directory
- Integration tests go in `tests/integration/` directory
- Test files should follow the pattern `*.test.ts` or `*.spec.ts`
- Mock external dependencies in unit tests
- Use real database connections for integration tests (with test database)

### Test Quality Standards
- Maintain minimum 60% coverage across all metrics (branches, functions, lines, statements)
- Write tests for new features and bug fixes
- Update existing tests when modifying functionality
- Use descriptive test names that explain the expected behavior
- Group related tests using `describe` blocks

### Debugging Tests
- Use `npm run test:watch` to run tests in watch mode
- Add `--verbose` flag for detailed test output
- Use `console.log` sparingly in tests (prefer proper assertions)
- Run specific test files: `npm test -- tests/unit/specific-file.test.ts`
- Run specific test cases: `npm test -- --testNamePattern="specific test name"`

## Code Quality Standards

### TypeScript & Linting
- Run `npm run typecheck` to verify TypeScript compilation without emitting files
- Use `npm run lint` to check code style and catch potential issues
- Run `npm run lint:fix` to automatically fix linting issues where possible
- All code must pass TypeScript strict mode checks
- Follow the existing code style and naming conventions

### Code Organization
- Keep business logic in `src/services/`
- Database schemas and migrations in `src/db/`
- API routes in `src/api/`
- Utility functions in `src/utils/`
- Type definitions in `src/types/`
- Background jobs in `src/workers/`

### Performance & Security
- Use proper error handling with try/catch blocks
- Validate all inputs using Zod schemas
- Implement proper rate limiting for API endpoints
- Use transactions for multi-step database operations
- Log important events but avoid logging sensitive data

## Development Workflow

### Before Starting Work
1. Pull the latest changes from main: `git pull origin main`
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Install dependencies: `npm install`
4. Set up environment: `cp .env.example .env` (and fill in values)
5. Initialize database: `npm run db:setup`

### During Development
1. Start development servers: `npm run dev:full`
2. Write tests alongside your code
3. Run tests frequently: `npm run test:watch`
4. Check types and linting: `npm run validate`
5. Commit changes in logical chunks with clear messages

### Before Submitting PR
1. Ensure all tests pass: `npm run test:ci`
2. Verify TypeScript compilation: `npm run build`
3. Check code quality: `npm run validate`
4. Update documentation if needed
5. Test the application manually in development environment

## PR Instructions

### Title Format
`[feature|fix|docs|refactor]: Brief description of changes`

Examples:
- `[feature]: Add lead qualification scoring system`
- `[fix]: Resolve email parsing issue with ADF format`
- `[docs]: Update API documentation for webhook endpoints`
- `[refactor]: Improve database connection pooling`

### PR Description Template
```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed
- [ ] All existing tests pass

## Checklist
- [ ] Code follows the project's style guidelines
- [ ] Self-review of code completed
- [ ] Code is commented where necessary
- [ ] Documentation updated (if applicable)
- [ ] No new TypeScript errors introduced
- [ ] Database migrations tested (if applicable)
```

### Review Process
- All PRs require at least one approval
- Address all review comments before merging
- Ensure CI/CD pipeline passes completely
- Squash commits when merging to maintain clean history
- Delete feature branch after successful merge

## Troubleshooting

### Common Issues
- **Database connection errors**: Check DATABASE_URL in .env and ensure PostgreSQL is running
- **Redis connection errors**: Verify REDIS_URL and ensure Redis server is accessible
- **TypeScript errors**: Run `npm run typecheck` to see detailed error messages
- **Test failures**: Check test database setup and environment variables
- **Build failures**: Clear `dist/` directory and run `npm run build` again

### Getting Help
- Check existing issues in the GitHub repository
- Review the project documentation in README.md
- Ask questions in team communication channels
- Create detailed bug reports with reproduction steps

## Security Guidelines

### Sensitive Data
- Never commit API keys, passwords, or secrets
- Use environment variables for all configuration
- Rotate secrets regularly in production
- Use different secrets for each environment

### Code Security
- Validate all user inputs
- Use parameterized queries to prevent SQL injection
- Implement proper authentication and authorization
- Keep dependencies updated and scan for vulnerabilities

---

*This guide is a living document. Please update it as the project evolves and new practices are established.*
