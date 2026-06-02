/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")

  users.otp.enabled = true
  users.otp.duration = 300
  users.otp.length = 6
  users.otp.emailTemplate.subject = "Your ASNEB sign-in code"
  users.otp.emailTemplate.body = `
<p>Your ASNEB passage code is:</p>
<p style="font-size:24px;letter-spacing:6px;"><strong>{OTP}</strong></p>
<p>This code expires in 5 minutes.</p>
`

  users.resetPasswordTemplate.subject = "Reset your ASNEB password"

  return app.save(users)
}, (app) => {
  const users = app.findCollectionByNameOrId("users")

  users.otp.enabled = false
  users.otp.duration = 180
  users.otp.length = 8

  return app.save(users)
})
