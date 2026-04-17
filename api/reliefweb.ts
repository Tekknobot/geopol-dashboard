export default async function handler(req: any, res: any) {
  try {
    const { searchParams } = new URL(req.url, `http://${req.headers.host}`)

    const queryString = searchParams.toString()

    const reliefUrl =
      `https://api.reliefweb.int/v2/reports?${queryString}`

    const response = await fetch(reliefUrl)

    const data = await response.text()

    res.setHeader("Content-Type", "application/json")
    res.status(200).send(data)

  } catch (err: any) {
    res.status(500).json({
      error: "ReliefWeb proxy failed",
      details: err.message
    })
  }
}
