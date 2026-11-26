# Render build dependency fix

The project originally declared `esbuild` as `^0.25.0`, but the Vite 8.x version resolved by npm declares an optional peer dependency on `esbuild` `^0.27.0 || ^0.28.0`.

The `package.json` in this version has been corrected to:

```json
"esbuild": "^0.28.0"
```

For the existing GitHub repository, either replace the repository's root `package.json` with this version or edit only that one dependency line in GitHub, then commit the change to `main`. Render should automatically redeploy.

Use Render build command:

```sh
npm install && npm run build
```

Use Render start command:

```sh
npm start
```

This fixes the dependency conflict shown in the Render log. A successful full build still needs to be confirmed by Render.
