import { GoogleIcon } from "@feel-good/icons";
import { Button } from "@feel-good/ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@feel-good/ui/primitives/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@feel-good/ui/primitives/field";
import { Input } from "@feel-good/ui/primitives/input";

export function MagicLinkLoginForm({
  ...props
}: React.ComponentProps<typeof Card>) {
  return (
    <div className="flex flex-col w-full items-center" {...props}>
      <Card
        {...props}
        className="max-w-md w-full rounded-4xl p-4 py-8 pb-10 border-transparent"
      >
        <CardHeader>
          <CardTitle className="font-medium text-center text-2xl">
            Login
          </CardTitle>
          <CardDescription className="sr-only">
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email" className="px-1.5">
                  Email <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  variant="underline"
                />
              </Field>

              <Field>
                <Button type="submit" size="lg" variant="primary">
                  Send magic link
                </Button>
                <div className="text-center text-sm text-muted-foreground my-4">
                  or continue with
                </div>
                <Button variant="outline" type="button" size="lg">
                  <GoogleIcon className="size-4 text-primary" />
                  Login with Google
                </Button>
                <FieldDescription className="text-center text-sm pt-4">
                  Don&apos;t have an account?{" "}
                  <a
                    href="#"
                    className="text-muted-foreground"
                  >
                    Sign up
                  </a>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
