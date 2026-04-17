export default async function handler(req: any, res: any) {
  try {
    const { searchParams } = new URL(req.url, `http://${req.headers.host}`)

    const queryString = searchParams.toString()

    const gdeltUrl =
      `https://api.gdeltproject.org/api/v2/geo/geo?${queryString}`

    const response = await fetch(gdeltUrl)

    const data = await response.text()

    res.setHeader("Content-Type", "application/json")
    res.status(200).send(data)

  } catch (err: any) {
    res.status(500).json({
      error: "GDELT proxy failed",
      details: err.message
    })
  }
}
