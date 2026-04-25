\# Rapat Reses Module



This repository contains a reusable backend module for managing Rapat Reses content, including image upload, rich HTML content storage, PDF generation from `body_html`, manual PDF upload, PDF compression, PDF download, and PDF-to-editable-HTML draft import.



\## Main Features



This module supports:



\- Create Rapat Reses data

\- Read all Rapat Reses data

\- Read Rapat Reses by ID

\- Update Rapat Reses data

\- Delete Rapat Reses data

\- Upload main Rapat Reses image

\- Delete main Rapat Reses image

\- Upload editor image for `body_html`

\- Generate PDF from `body_html`

\- Download generated PDF

\- Upload manual PDF

\- Compress PDF if the file is larger than the configured limit

\- Import uploaded PDF into editable draft HTML



Required dependencies : 

* Node.js: Express, sequelize, mysql2, multer, sharp, puppeteer. 
* Environtment variables: dotenv
* PDF import helper: pdf-parse
* Compressor: ghostscript



PDF Processing provides:

* PDF buffer validation
* PDF size checking
* PDF compression using Ghostscript
* Maximum final PDF size control 



Frontend Integration Guide

* Recommended Frontend Flow
* Admin creates Rapat Reses data.
* Admin writes or edits rich HTML content using a rich text editor.
* If the editor needs images, upload images through routes (API) 
* Insert returned image_url into the editor.
* Save the final HTML into body_html.
* Generate PDF using created API 
* Show the generated PDF URL or provide a download button.
* Download PDF using API 	



The frontend should avoid sending base64 images inside `body_html`.

Do not send this: img src="data:image/png;base64,..." 

Use this instead: img src="https://your-domain.com/storage/rapat_reses_editor/2026/04/image.webp" 



Recommended editor libraries: TipTap, CKEditor, TinyMCE, Quill

