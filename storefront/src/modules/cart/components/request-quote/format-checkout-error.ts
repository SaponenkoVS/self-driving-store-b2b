export const formatCheckoutError = (message: string | null) => {
  if (!message) {
    return message
  }

  const match = message.match(/APPROVAL_[A-Z]+:\s*([\s\S]*)$/)

  return match ? match[1].replace(/\.\.$/, ".") : message
}
