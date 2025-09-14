# Version Control & Rollback Guide

## Quick Rollback Commands

### 🔥 Emergency Rollback Options

**Back to clean Next.js (before all our work):**
```bash
git checkout 4da3841  # Initial Next.js commit
# or create a new branch from initial state
git checkout -b clean-start 4da3841
```

**Back to working internationalization:**
```bash
git checkout v1.0-i18n-complete
# or reset current branch to this state
git reset --hard v1.0-i18n-complete
```

### 🏷️ Available Tags & Milestones

- `4da3841` - Initial Next.js app (clean slate)
- `v1.0-i18n-complete` - Full internationalization with 7 languages

### 🌳 Branch Structure

- `main` - Current stable version with i18n
- `development` - For ongoing development work  
- `feature/internationalization` - Backup of i18n implementation

### 📋 Common Rollback Scenarios

#### Scenario 1: "I want to start fresh with clean Next.js"
```bash
git checkout 4da3841
git checkout -b fresh-start
# You now have a clean Next.js app
```

#### Scenario 2: "Something broke, get back to working i18n"
```bash
git reset --hard v1.0-i18n-complete
npm install  # Reinstall dependencies
npm run dev  # Should work perfectly
```

#### Scenario 3: "I want to experiment safely"
```bash
git checkout -b experiment-feature
# Make changes, if they break:
git checkout main  # Back to safety
git branch -D experiment-feature  # Delete broken experiment
```

#### Scenario 4: "Undo last few commits but keep files"
```bash
git log --oneline  # See recent commits
git reset --soft HEAD~2  # Undo last 2 commits, keep changes
```

#### Scenario 5: "Nuclear option - completely clean slate"
```bash
git reset --hard 4da3841
git clean -fd  # Remove all untracked files
npm install
```

### 🔍 View History & Tags

```bash
# See all commits
git log --oneline --graph

# See all tags
git tag -l

# See what changed in a commit
git show v1.0-i18n-complete

# See current branches
git branch -a
```

### 💾 Creating New Milestones

```bash
# When you finish a feature
git add .
git commit -m "Add new feature: description"
git tag -a v1.1-feature-name -m "Description"
```

### 🆘 Recovery Commands

```bash
# Lost changes? Check reflog
git reflog

# Recover deleted branch
git checkout -b recovered-branch HEAD@{n}

# Unstage all changes
git reset HEAD

# Discard all local changes
git checkout -- .
```

## Current Project Structure

```
hokku-training-sim/
├── src/app/[locale]/          # Internationalized pages
├── messages/                  # Translation files (7 languages)
├── src/i18n/                 # i18n configuration
├── src/components/           # Reusable components
├── src/lib/                  # Utility functions
└── *.sql                    # Database schemas
```

## What Each Version Contains

### Initial Commit (4da3841)
- Clean Next.js 15 app with TypeScript
- Basic Tailwind CSS setup
- No authentication or i18n

### v1.0-i18n-complete (current)
- Full internationalization (EN, RU, DE, ES, KA, FR, IT)
- Supabase authentication
- Language switcher
- Dark theme UI
- Database schemas
- Working auth & dashboard pages

---

**Remember**: Always create a backup branch before major changes!
```bash
git checkout -b backup-$(date +%Y%m%d)
```