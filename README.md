# Rental application

An online rental application for the Deer Crossing condo in Mashpee, MA, with a private page for reviewing what applicants send.

- `/` is the application form. Send this link to applicants.
- `/admin` is the review page. It asks for your password. From there you can download a PDF of any application, or one PDF with all of them.

Answers and attached proof-of-income files are stored in the Postgres database. Nothing is emailed.

## Put it on Railway

1. Create a **private** GitHub repository and upload every file in this folder.
2. In Railway, choose **New Project**, then **Deploy from GitHub repo**, and pick the repository.
3. In the same project, choose **Create**, then **Database**, then **PostgreSQL**.
4. Open the app service, go to **Variables** and add:
   - `DATABASE_URL` set to `${{Postgres.DATABASE_URL}}`
   - `ADMIN_PASSWORD` set to a long password only you know
5. Go to **Settings**, then **Networking**, and choose **Generate Domain**. That address is the link you send to applicants.

The database tables are created the first time the app starts.

## Settings

All optional except the first two.

| Variable | What it does | Default |
| --- | --- | --- |
| `DATABASE_URL` | Postgres connection | required |
| `ADMIN_PASSWORD` | Password for `/admin` | required |
| `PROPERTY_NAME` | Name in the page heading | Deer Crossing |
| `PROPERTY_ADDRESS` | Address line under the heading. Add the unit number here. | Deer Crossing condominium, Mashpee, MA 02649 |
| `MONTHLY_RENT` | Monthly rent | 3200 |
| `LAST_MONTH_RENT` | Last month's rent due at signing. Set to 0 if you do not collect it. | same as rent |
| `SECURITY_DEPOSIT` | Security deposit due at signing. Set to 0 if you do not collect one. | same as rent |
| `CONTACT_EMAIL` | Shown to applicants for questions | none |
| `NOTIFY_WEBHOOK_URL` | Receives a small JSON message (name, email, phone, move-in date) each time someone applies. A GoHighLevel inbound webhook works. | none |
| `SESSION_SECRET` | Any long random text. Keeps you signed in when the app redeploys. | random at each start |

Last month's rent and the security deposit are each capped at one month's rent, which is the Massachusetts limit (M.G.L. c. 186, s. 15B).

## Changing the questions

Every question lives in `lib/form.js`. The form, the review page and the spreadsheet export are all drawn from that one file.

The eviction question carries a notice that Massachusetts requires on any housing application that asks about evictions (M.G.L. c. 239, s. 16). Keep the notice if you keep the question.

## What it does to protect applicant data

- The form does not ask for a Social Security number or date of birth.
- The review page, attached files and spreadsheet export all need the password.
- Pages are marked so search engines do not list them.
- Each application has a delete button that removes its answers and files for good.

## Run it on your own computer

```
npm install
DATABASE_URL=postgresql://localhost/rental ADMIN_PASSWORD=change-me npm start
```
