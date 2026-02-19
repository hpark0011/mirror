import { PageSection } from "@/components/page-section";
import { PageSectionHeader } from "@/components/page-section-header";
import { Divider } from "@/components/divider";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@feel-good/ui/primitives/table";

const invoices = [
  { invoice: "INV001", status: "Paid", method: "Credit Card", amount: 250.0 },
  { invoice: "INV002", status: "Pending", method: "PayPal", amount: 150.0 },
  { invoice: "INV003", status: "Unpaid", method: "Bank Transfer", amount: 350.0 },
  { invoice: "INV004", status: "Paid", method: "Credit Card", amount: 450.0 },
  { invoice: "INV005", status: "Paid", method: "PayPal", amount: 550.0 },
];

export function TableVariants() {
  return (
    <div className="flex flex-col w-full">
      <Divider />

      <PageSection>
        <PageSectionHeader>Basic Table</PageSectionHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.invoice}>
                <TableCell className="font-medium">
                  {invoice.invoice}
                </TableCell>
                <TableCell>{invoice.status}</TableCell>
                <TableCell>{invoice.method}</TableCell>
                <TableCell className="text-right">
                  ${invoice.amount.toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>With Caption</PageSectionHeader>
        <Table>
          <TableCaption>A list of recent invoices.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.invoice}>
                <TableCell className="font-medium">
                  {invoice.invoice}
                </TableCell>
                <TableCell>{invoice.status}</TableCell>
                <TableCell>{invoice.method}</TableCell>
                <TableCell className="text-right">
                  ${invoice.amount.toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>With Footer</PageSectionHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.invoice}>
                <TableCell className="font-medium">
                  {invoice.invoice}
                </TableCell>
                <TableCell>{invoice.status}</TableCell>
                <TableCell>{invoice.method}</TableCell>
                <TableCell className="text-right">
                  ${invoice.amount.toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3}>Total</TableCell>
              <TableCell className="text-right">
                ${invoices.reduce((sum, inv) => sum + inv.amount, 0).toFixed(2)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>State: Selected Row</PageSectionHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice, i) => (
              <TableRow
                key={invoice.invoice}
                data-state={i === 1 ? "selected" : undefined}
              >
                <TableCell className="font-medium">
                  {invoice.invoice}
                </TableCell>
                <TableCell>{invoice.status}</TableCell>
                <TableCell>{invoice.method}</TableCell>
                <TableCell className="text-right">
                  ${invoice.amount.toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </PageSection>
    </div>
  );
}
