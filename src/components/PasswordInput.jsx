import { useState } from 'react'

export function PasswordInput({
  value,
  onChange,
  placeholder = 'Password',
  disabled = false,
  required = false,
  autoComplete = 'current-password',
  id,
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="password-field-wrap">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        className="text-input"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className="password-toggle-btn"
        onClick={() => setVisible((prev) => !prev)}
        disabled={disabled}
        aria-label={visible ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}
