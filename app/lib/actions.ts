'use server' // ---> Marcar que todas las funciones que se exportan en este archivo, son de servidor y por lo tanto no se ejecutan ni se envian al cliente
import { z } from 'zod';
import { Invoice } from './definitions';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';



const FormSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  amount: z.coerce.number(),
  status: z.enum(['pending', 'paid']),
  date: z.string()
})

const CreateInvoiceFormSchema = FormSchema.omit({
  id: true,
  date: true
})

export async function createInvoice(formData: FormData) {
  const {customerId, amount, status} = CreateInvoiceFormSchema.parse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  })
  //transformamos para evitar errores de redondeo
  const amountInCents = amount * 100

  //creamos la fecha actual
  const [date] = new Date().toISOString().split('T')
  try {
    await sql`
    INSERT INTO invoices (customer_id, amount, status, date)
    VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
  ` 
  } catch (error) {
    return {
      message: 'Database Error: Failed to Create Invoice.',
    };
  }

  //le avisamos que ruta debe recargar para no utilizar la informacion vieja guardada en cache
  revalidatePath('/dashboard/invoices')
  redirect('/dashboard/invoices')

}
// en caso de tener muchas variables:
// const rawFormData = Object.fromEntries(formData.entries())


const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function updateInvoice(id: string, formData: FormData) {
  const { customerId, amount, status } = UpdateInvoice.parse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  })

  const amountInCents = amount * 100
  try {
    await sql`
    UPDATE invoices
    SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
    WHERE id = ${id}
    `
  } catch (error) {
    return { message: 'Database Error: Failed to Update Invoice.' };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
  throw new Error('Failed to Delete Invoice');
  try {
    await sql`DELETE FROM invoices WHERE id = ${id}`;
    revalidatePath('/dashboard/invoices');
  } catch (error) {
    return { message: 'Database Error: Failed to Delete Invoice.' };
  }
}