const fs = require("fs");
const path = require("path");

function createLogger(options = {}) {
  const {
    logDir = path.join(__dirname, "logs"),
    logFileName = "log.csv",
    maxLines = 20,
  } = options;

  const logFilePath = path.join(logDir, logFileName);
  const header = "Agent,Time,Method,Resource,Version,Status\n";

  let lineCount = 0;
  let isRotating = false;

  function initializeLogFile() {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    if (!fs.existsSync(logFilePath)) {
      fs.writeFileSync(logFilePath, header, "utf8");
      lineCount = 1;
      return;
    }

    const data = fs.readFileSync(logFilePath, "utf8");
    const lines = data.split("\n").filter(l => l.trim() !== "");

    if (lines.length === 0 || lines[0] !== header.trim()) {
      fs.writeFileSync(logFilePath, header + lines.join("\n") + "\n", "utf8");
      lineCount = 1 + lines.length;
    } else {
      lineCount = lines.length;
    }
  }

  function rotateLogs(done) {
    if (isRotating) return done();
    isRotating = true;

    const log1 = path.join(logDir, "log1.csv");
    const log2 = path.join(logDir, "log2.csv");

    const step3 = () => {
      fs.rename(logFilePath, log1, (err) => {
        if (err) {
          isRotating = false;
          return done(err);
        }

        fs.writeFile(logFilePath, header, (err2) => {
          isRotating = false;
          if (err2) return done(err2);
          lineCount = 1;
          done();
        });
      });
    };

    const step2 = () => {
      fs.exists(log1, (exists1) => {
        if (!exists1) return step3();

        fs.rename(log1, log2, (err) => {
          if (err) {
            fs.unlink(log2, () => {
              fs.rename(log1, log2, (err2) => {
                if (err2) {
                  isRotating = false;
                  return done(err2);
                }
                step3();
              });
            });
            return;
          }
          step3();
        });
      });
    };

    fs.exists(log2, (exists2) => {
      if (!exists2) return step2();
      fs.unlink(log2, () => step2());
    });
  }

  function parseLogsCsv(csvText) {
    const lines = csvText.split("\n").filter(l => l.trim() !== "");
    if (lines.length <= 1) return [];

    return lines.slice(1).map(line => {
      const [Agent, Time, Method, Resource, Version, Status] = line.split(",");
      return { Agent, Time, Method, Resource, Version, Status };
    });
  }

  function requestLogger(req, res, next) {
    res.on("finish", () => {
      const agent = (req.headers["user-agent"] || "unknown");

      const logLine =
        [
          agent,
          new Date().toISOString(),
          req.method,
          req.originalUrl,
          `HTTP/${req.httpVersion}`,
          res.statusCode,
        ].join(",") + "\n";

      console.log(logLine.trim());

      const append = () => {
        fs.appendFile(logFilePath, logLine, (err) => {
          if (err) return console.error("Error writing to log file:", err);
          lineCount++;
        });
      };

      if (lineCount >= maxLines) {
        rotateLogs((err) => {
          if (err) console.error("Error rotating logs:", err);
          append();
        });
      } else {
        append();
      }
    });

    next();
  }

  function getLogs(req, res) {
    fs.readFile(logFilePath, "utf8", (err, data) => {
      if (err) return res.status(500).send("Error reading log file");
      res.json(parseLogsCsv(data));
    });
  }

  initializeLogFile();

  return {
    requestLogger,
    getLogs,
    paths: { logDir, logFilePath },
  };
}

module.exports = { createLogger };