const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".mp3": "audio/mpeg",
  ".glb": "model/gltf-binary",
  ".svg": "image/svg+xml",
  ".json": "application/json"
};

http
  .createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split("?")[0]);

    // Support /test_polio mapping
    if (urlPath === "/test_polio" || urlPath === "/test_polio/") {
      urlPath = "/index.html";
    } else if (urlPath.startsWith("/test_polio/")) {
      urlPath = urlPath.substring("/test_polio".length);
    }

    // Also support normal root
    if (urlPath === "/") {
      urlPath = "/index.html";
    }

    const file = path.resolve(root, "." + urlPath);

    // Prevent access outside project folder
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403);
      return res.end("Forbidden");
    }

    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end("Not found");
      }

      res.setHeader(
        "Content-Type",
        types[path.extname(file).toLowerCase()] ||
          "application/octet-stream"
      );

      res.end(data);
    });
  })
  .listen(4173, "127.0.0.1", () => {
    console.log("Drop Dash running:");
    console.log("http://127.0.0.1:4173/");
    console.log("http://127.0.0.1:4173/test_polio/");
  });