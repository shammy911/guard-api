import "dotenv/config";

for (let i = 1; i <= 40; i++) {
  fetch("http://localhost:3000/check", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-guard-key": `${process.env.MASTER_KEY}`,
      "x-api-key": `${process.env.API_KEY_FREE}`,
    },
    body: JSON.stringify({ route: "/api/login" }),
  })
    .then((r) => r.json())
    .then((d) => console.log(i, d));
}
