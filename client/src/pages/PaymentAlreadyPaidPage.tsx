import { Card, CardDescription, CardTitle } from "../components/ui";

/**
 * Shown when the user opens an SMS pay link but the installment is already settled.
 * Server redirects here when `CLIENT_APP_URL` is set and the pay token resolves to `already_paid`.
 */
export function PaymentAlreadyPaidPage() {
  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-background via-muted/50 to-secondary/30 px-4 py-16">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-2xl text-teal-800 dark:bg-teal-950 dark:text-teal-200">
            ✓
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Already paid
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This installment is already paid. Thank you.
          </p>
        </div>

        <Card className="p-6 shadow-md">
          <CardTitle className="text-base">You’re all set</CardTitle>
          <CardDescription className="mt-2">
            No further payment is needed for this fee installment. If you believe
            this is a mistake, contact the school office with your scholar or
            admission details.
          </CardDescription>
        </Card>
      </div>
    </div>
  );
}
