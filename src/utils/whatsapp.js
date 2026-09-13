export async function sendWhatsApp(phone, customerName, orderId) {
    const accessToken = "EAAYcDaZCDKysBRhYKqN60k0OIZCyPgwio6s16ULfyPbI80vI2YFk8NfQchoadcyo4qd7iDbKZBEfCQcWN5ZBHkU0vM0PZA5UPC1QVdZC5tsm587cnW63HkBWdfLYBYkXUoSCr4rXj7WQ8pONuAZASL6RWvuC9IXqbvLA4uO526DPTajlZBWe6JzhJG3PM2K8VPyosh7hfXgKrcUqSpHJ60F8zlOzWGXAL8Rv0CHWOGcze6YxlVh5MTPYoBNaq7z1NOpHoeaMsIrGeMLVw6AvCGLEfvkVbQZDZD";
    const phoneNumberId = "1119127341285536";

    // Format phone number: remove non-digits, ensure country code 91 if exactly 10 digits
    let formattedPhone = phone ? String(phone).replace(/\D/g, '') : '';
    if (formattedPhone.length === 10) {
        formattedPhone = '91' + formattedPhone;
    }

    if (!formattedPhone) return;

    const messageText = `Hi ${customerName || 'Customer'} Your Item (${orderId}) ready for delivery please collect it\n\nThank you\nMalka`;

    try {
        const response = await fetch(
            `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    messaging_product: "whatsapp",
                    recipient_type: "individual",
                    to: formattedPhone,
                    type: "text",
                    text: {
                        preview_url: false,
                        body: messageText
                    },
                }),
            }
        );

        const data = await response.json();
        console.log("WhatsApp API Response:", data);

        if (data.error) {
            throw new Error(data.error.message || "Unknown WhatsApp API error");
        }

        return data;
    } catch (err) {
        console.error("WhatsApp API Error:", err);
        throw err;
    }
}
