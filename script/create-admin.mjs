const BASE = "http://127.0.0.1:5000";

async function main() {
  const res = await fetch(BASE + "/api/users/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "cto@tryingapp.com",
      password: "TryingCTO@2026",
      name: "Platform Admin",
      restaurantName: "Platform Administration",
    }),
  });
  const data = await res.json();
  console.log("Status:", res.status);
  console.log("Response:", JSON.stringify(data, null, 2));
}

main();
