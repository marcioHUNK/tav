const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors()); // libera CORS para o front-end

app.get('/api/ultima-localizacao', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).send('URL da planilha é obrigatória');
  }

  try {
    // Faz a requisição para a planilha (SharePoint)
    const response = await fetch(url, {
      headers: {
        'Accept': 'text/plain, application/json, text/csv'
        // Se precisar de autenticação, adicione um token aqui
      }
    });

    if (!response.ok) {
      throw new Error(`Erro ao acessar planilha: ${response.status}`);
    }

    const texto = await response.text();
    res.send(texto);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Proxy rodando em http://localhost:${PORT}`);
});