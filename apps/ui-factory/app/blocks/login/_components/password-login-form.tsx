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

export function PasswordLoginForm({
  ...props
}: React.ComponentProps<typeof Card>) {
  return (
    <div className="flex flex-col w-full items-center" {...props}>
      <Card className="max-w-md w-full rounded-4xl p-4 py-8 pb-10 border-transparent">
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
                  placeholder="m@example.com"
                  required
                  variant="underline"
                />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password" className="px-1.5">
                    Password <span className="text-destructive">*</span>
                  </FieldLabel>
                  <a
                    href="#"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline text-muted-foreground hover:text-blue-500 pr-1.5 leading-0"
                  >
                    Forgot your password?
                  </a>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  placeholder="Enter your password"
                  variant="underline"
                />
              </Field>
              <Field>
                <Button type="submit" size="lg" variant="primary">Login</Button>
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
