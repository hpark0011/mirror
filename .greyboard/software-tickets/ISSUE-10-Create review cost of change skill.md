---
version: 1
id: ISSUE-10
title: Create review cost of change skill
status: in_progress
priority: none
assignee: self
agentExecution: null
sortOrder: 65529
labels: []
blockedBy: []
parentId: null
projectId: null
worktree:
  enabled: true
  baseRef: main
createdBy: user
updatedBy: user
createdAt: 2026-08-03T06:16:47.446Z
updatedAt: 2026-08-03T06:49:13.792Z
completedAt: null
---
1. **Domain Driven Design**: Start by understanding the business domain before building objects. Avoid "God Objects" (over-polluted objects) and "Kitchen Sink" mappings (mapping all source columns) by focusing on specific, real-world entities.
2. **Don't Repeat Yourself (DRY)**: Avoid creating redundant object types for the same entity across different departments (e.g., separate sales, support, and billing customers). Use interfaces to unify these views and minimize "Action Sprawl" and system silos.
3. **Open-Closed Principle**: Design objects to be open for extension but closed for modification. This allows for adding new capabilities or linked objects without breaking existing production workflows or causing ripple effects.
4. **Composition over Deep Hierarchies**: Avoid long, rigid, parent-child inheritance chains. Instead, use composition and interfaces to define shared behaviors and properties, which provides greater flexibility and prevents "Misnomer" anti-patterns.

Codebase quality is mostly invisible.

A refactor may look cleaner but make future changes harder. A domain document may look comprehensive but fail to describe reality. A tool may report fewer code smells without reducing bugs or uncertainty.

The maintainer therefore cannot easily answer:

- Is this codebase easier to change than before?
- Did the domain cleanup reduce hidden coupling?
- Are agents finding the correct owner more directly?
- Are changes becoming more local and predictable?
- Did the improvement system actually work?

The fundamental problem is:

> **How can we provide observable evidence that the codebase is becoming easier, safer, and more predictable to change?**

This is the **proof problem**.

The proof system compares predicted work with actual agent behavior. It observes where agents searched, what they read, which domains they crossed, what they modified, what unexpectedly failed, and how much backtracking occurred. It then visualizes whether work is becoming more direct and localized over time.