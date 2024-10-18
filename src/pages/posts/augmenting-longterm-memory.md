---
layout: ../../components/blog.astro
title: Augmenting Long-term Memory
url: https://augmentingcognition.com/ltm.html
references:
  - "[[Spaced Repetition]]"
tags:
  - prompt
publish: true
---

## Introduction [[2024-06-02]]
This articles main conjecture that good memory helps us think better and that good memory is a choice. First half talks about: what is [[Anki]], patterns and anti-patterns in Anki, how to build deep understanding of complex topics. Second half talks about: different memory systems, role of memory in creativity and problem solving.

As an example I'm going to read [[pages/What every systems programmer should know about concurrency]] following along along this article. The author suggests reading a paper in multiple passes:
- _skimming_ pass:
	- identify core ideas of the paper and basic terminology used in it
	- make multiple such _skimming_ passes to collect ideas that are easy to understand
	- if something is difficult to understand, don't spend too much time on it, just keep reading
	- these reading passes should be quick
	- keep adding questions about elementary facts to Anki
- _thorough_ pass:
	- read slower
	- add more in-depth questions
## How spaced repetition works [[2024-06-04]]
The author points out that Anki works much better when it is used as an aid to personal project/aim, describing this using emotional commitment. [[Andy Matuschak]] in his talk [[How might we learn]] makes the same point. Learning is only effective when it is about something the we deeply care about.

### Tips on writing [[Spaced Repetition Prompt|cards]]
- Write atleast 5 to 20 questions.
- Use figures, if you can.
- Make questions and answers as atomic as possible. Atomic questions are about putting focus on the parts of questions that you are most likely to get wrong. This also forces one into the habit of breaking a concept asking atomic questions.
- Avoid orphan questions, questions should be inter-connected to one another. Questions also need to be connected to the goals of my learning. If they do not, they can be considered "orphan" questions.
  
### Tips on how to use [[Anki]]
- Use one big deck.
- Don't share decks or re-use other's deck.

### How to do shallow reads?
- Ankify about core claims, questions and ideas.
- Instead of writing questions as "facts" always write questions pointing to sources.
- Questions that point out different properties/reasons. 
  As example, from [[pages/What every systems programmer should know about concurrency|this paper]]: what makes lockless and locking different from each other?

### Why construct your own cards and deck?
> Writing Anki cards is an act of understanding in itself. That is, figuring out good questions to ask, and answers.

- Research shows that the more elaborately we encode a memory, the stronger that memory is.
- Asking questions that connect two concepts, reinforces both of them, this is called "elaborative encoding".
- Cultivate your own strategies for elaborative encoding. For example, asking the same question in different ways, reinforces the same idea but from different angles.

### Procedural vs. declarative memory
- How to use Anki to memorise things and recognise situations in which those things are useful?
- [[Andy Matuschak]] also [[How might we learn|mentions]] that AI agents can integrate flash cards from one's daily tasks and vice-versa.
