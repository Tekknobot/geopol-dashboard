export default async function handler(req: any, res: any) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`)

    const gdeltUrl =
      "https://api.gdeltproject.org/api/v2/geo/geo?" +
      url.searchParams.toString()

    const r = await fetch(gdeltUrl)
    const text = await r.text()

    res.setHeader("Content-Type", "application/json")
    res.status(200).send(text)

  } catch (e: any) {
    res.status(500).json({
      error: "GDELT proxy failed",
      details: e.message
    })
  }
}