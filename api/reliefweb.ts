export default async function handler(req: any, res: any) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`)

    const reliefUrl =
      "https://api.reliefweb.int/v2/reports?" +
      url.searchParams.toString()

    const r = await fetch(reliefUrl)
    const text = await r.text()

    res.setHeader("Content-Type", "application/json")
    res.status(200).send(text)

  } catch (e: any) {
    res.status(500).json({
      error: "ReliefWeb proxy failed",
      details: e.message
    })
  }
}