1. **Create a static JSON file `allowed_files.json`:**
   - This file will be placed in `apps/editor/`.
   - It will contain the list of allowed files with their paths and descriptions.

2. **Modify the `get_allowed_files` function in `apps/editor/server.ts`:**
   - The function will now read the `allowed_files.json` file.
   - It will return the content of the JSON file as a string.

3. **Update documentation:**
   - Create a report file `jules/plan026-report.md`.
   - Update the main development documentation `jules.md`.
   - Update `agents.md` if necessary.

4. **Verify the changes:**
   - Run the tests to make sure I haven't broken anything.
   - I will run `pnpm build` and `pnpm test` to ensure everything is working correctly.
