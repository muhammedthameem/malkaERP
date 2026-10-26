import cors from 'cors'
import express from 'express'

const app = express()
const PORT = 5000

let adminUser = {
  email: 'admin@malka.com',
  password: 'malka@123',
}

app.use(cors())
app.use(express.json())

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, service: 'Malka Boutique API' })
})

app.post('/api/login', (request, response) => {
  const { email, password } = request.body

  if (!isValidEmail(email || '')) {
    return response.status(400).json({ message: 'Enter a valid email address.' })
  }

  if (email !== adminUser.email || password !== adminUser.password) {
    return response.status(401).json({ message: 'Invalid email or password.' })
  }

  return response.json({
    message: 'Login successful.',
    user: { email: adminUser.email, name: 'Admin' },
  })
})

app.post('/api/forgot-password', (request, response) => {
  const { email } = request.body

  if (!isValidEmail(email || '')) {
    return response.status(400).json({ message: 'Enter a valid email address.' })
  }

  if (email !== adminUser.email) {
    return response.status(404).json({ message: 'No admin account found for this email.' })
  }

  return response.json({
    message: 'Password reset request accepted. Please contact the boutique owner to reset access.',
  })
})

app.post('/api/change-password', (request, response) => {
  const { email, currentPassword, newPassword } = request.body

  if (!isValidEmail(email || '')) {
    return response.status(400).json({ message: 'Enter a valid email address.' })
  }

  if (email !== adminUser.email || currentPassword !== adminUser.password) {
    return response.status(401).json({ message: 'Current credentials are incorrect.' })
  }

  if (!newPassword || newPassword.length < 6) {
    return response.status(400).json({ message: 'New password must be at least 6 characters.' })
  }

  adminUser = { ...adminUser, password: newPassword }

  return response.json({ message: 'Password changed successfully. Please login again.' })
})

app.listen(PORT, () => {
  console.log(`Malka Boutique API running on http://127.0.0.1:${PORT}`)
})
