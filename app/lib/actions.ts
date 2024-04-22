'use server' // ---> Marcar que todas las funciones que se exportan en este archivo, son de servidor y por lo tanto no se ejecutan ni se envian al cliente
import { z } from 'zod';
import { Invoice } from './definitions';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Amiko } from 'next/font/google';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';



const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: 'Please select a customer.',
  }),
  amount: z.coerce
  .number()
  .gt(0, { message: 'Please enter an amount greater than $0.' }),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select an invoice status.',
  }),
  date: z.string()
})

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

const CreateInvoiceFormSchema = FormSchema.omit({
  id: true,
  date: true
})

export async function createInvoice(prevState: State, formData: FormData) {
  const validatedFields = CreateInvoiceFormSchema.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  })
  //si la validacion falla retorna los errores, sino continua
  
  if(!validatedFields.success){
    return{
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Mising Fields. Failed to Create Invoice'
    }
  }
  const { customerId, amount, status } = validatedFields.data;
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

export async function updateInvoice(
  id: string,
  prevState: State,
  formData: FormData,
) {
  const validatedFields = UpdateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });
 
  if (!validatedFields.success) {

    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Update Invoice.',
    };
  }
 
  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;
 
  try {
    await sql`
      UPDATE invoices
      SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
      WHERE id = ${id}
    `;
  } catch (error) {
    return { message: 'Database Error: Failed to Update Invoice.' };
  }
 
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {

  try {
    await sql`DELETE FROM invoices WHERE id = ${id}`;
    revalidatePath('/dashboard/invoices');
  } catch (error) {
    return { message: 'Database Error: Failed to Delete Invoice.' };
  }
}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}