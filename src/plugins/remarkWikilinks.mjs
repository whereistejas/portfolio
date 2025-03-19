import { visit } from "unist-util-visit";

export function remarkWikilinks() {
  return (tree) => {
    visit(tree, "text", (node, index, parent) => {
      const text = node.value;

      if (!text.includes("[[")) return;

      const parts = [];
      let currentIndex = 0;

      while (currentIndex < text.length) {
        const openBrackets = text.indexOf("[[", currentIndex);

        if (openBrackets === -1) {
          // No more wikilinks, add remaining text
          if (currentIndex < text.length) {
            parts.push({
              type: "text",
              value: text.slice(currentIndex),
            });
          }
          break;
        }

        // Add text before the wikilink
        if (openBrackets > currentIndex) {
          parts.push({
            type: "text",
            value: text.slice(currentIndex, openBrackets),
          });
        }

        const closeBrackets = text.indexOf("]]", openBrackets);
        if (closeBrackets === -1) {
          // Unclosed wikilink, treat as normal text
          parts.push({
            type: "text",
            value: text.slice(currentIndex),
          });
          break;
        }

        const linkText = text.slice(openBrackets + 2, closeBrackets);

        parts.push({
          // type: "link",
          // url: `/archive/${linkText.replace(/\s+/g, "_")}`,
          // children: [
          //   {
          type: "text",
          value: linkText,
          //   },
          // ],
        });

        currentIndex = closeBrackets + 2;
      }

      // Replace just this text node with our parts
      if (parts.length) {
        parent.children.splice(index, 1, ...parts);
        return index + parts.length;
      }
    });
  };
}
