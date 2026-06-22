import { useState } from 'react'
import { LoginForm } from './features/auth/components/LoginForm'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <LoginForm></LoginForm>
    </>
  )
}

export default App
