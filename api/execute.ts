export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { code, stdin = "" } = req.body || {};

    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "Please provide C++ code." });
    }

    if (code.length > 30000 || String(stdin).length > 8000) {
      return res.status(400).json({ error: "Input is too large." });
    }

    const clientId = process.env.JDOODLE_CLIENT_ID;
    const clientSecret = process.env.JDOODLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: "JDoodle credentials are missing." });
    }

    const response = await fetch("https://api.jdoodle.com/v1/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        clientSecret,
        script: code,
        stdin: String(stdin),
        language: "cpp17",
        versionIndex: "0"
      })
    });

    const result = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: result.error || "Compiler request failed."
      });
    }

    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || "Compiler server error."
    });
  }
}
