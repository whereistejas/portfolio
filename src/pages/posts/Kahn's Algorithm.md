---
date: 2025-11-14
layout: ../../layouts/blog.astro
title: Kahn's Algorithm
---

Each graph has nodes and edges.

The edges can have a direction, they can either point “towards” a node or “away” from it, i.e., they are either **forward** or **reversed**.

- The count of how many edges point towards/into a node is called the **in-degree** of that node.
- The count of how many edges point away from a node is called **out-degree** of that node.

We can use the in-degree count to determine:

- how many dependencies a node has or
- how many other nodes are blocking this node or
- how many parents this node has

An adjacency-list is one way of representing a graph. Kahn’s algorithm works by removing layers of nodes that don’t have dependencies. Therefore, the adjacency list must represent the graph in a specific way.

The adjacency list must show:

- which other nodes have this node as prerequisite/dependency or
- which nodes are blocked by this node
- which nodes treat this node as their parent

In order to perform the steps in the algorithim you need two inputs: **in-degree count** for each node and a graph represented in the form of an **adjacency list**.

So, how does Kahn's algorithm work?

- Prepare adjacency list and in-degrees count.
- Initialize a counter for number of “processed” nodes.
- Collect all nodes with zero in-degrees in a queue.
- For each such node,
  - Add this node to a seperate list and increment the “processed” nodes counter.
  - Iterate through all nodes that have this node as a prerequisite.
  - Decrement their in-degree by 1 (because the edge with this node is now gone).
  - If any of them (after decrementing) has zero in-degrees, add them to queue.
- If “processed” nodes is greater than total number of nodes, we have a cycle.
- Continue until queue is empty

But what if, a graph doesn’t have any nodes with zero in-degrees? It means, that this graph is not a DAG. Kahn’s algorithm checks for this invariant as its very first step.

> Every DAG must always have at least one node with zero in-degrees.
