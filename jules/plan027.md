# Plan to Implement Multi-line Chat Input

## Goal

Modify the chat input in `apps/editor/web/components/ChatPanel.tsx` to support multi-line input, automatic resizing, and sending messages only via a button click.

## Task Breakdown

1.  **Modify ChatPanel Input Behavior:**
    - Remove the `onKeyDown` handler from the `<textarea>` in `ChatPanel.tsx` to prevent the Enter key from sending messages.
    - The `onSendMessage` function should now only be triggered by the "Send" button's `onClick` event.

2.  **Implement Dynamic Height for Textarea:**
    - I will use a React hook to manage the textarea's height. The height will be adjusted based on the `scrollHeight` of the textarea element.
    - The initial height will be a single line.
    - As the user types and adds new lines, the height will grow to fit the content.
    - I'll add a `max-height` to prevent the input box from becoming excessively large.

3.  **Reset Height After Sending:**
    - After a message is sent, the textarea's height should be reset to its initial single-line height. I'll achieve this by resetting the state that controls the height.

4.  **Create Report and Update Documentation:**
    - Create `jules/plan-multiline-chat-report.md` to document the process.
    - Update `jules.md` with any relevant details from this task.
    - Review `agents.md` and update it if necessary.

5.  **Run Tests and Verify:**
    - Run `pnpm build` and `pnpm test` to ensure no regressions have been introduced.
    - Run the editor with `pnpm dev:editor` and manually verify that the new input behavior works as expected.
