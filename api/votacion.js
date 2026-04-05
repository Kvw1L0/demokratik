// api/votacion.js
import { parseStringPromise } from 'xml2js';

// ESTA ES LA LÍNEA MÁGICA: Le dice a Node.js que ignore el certificado vencido del Congreso
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

export default async function handler(req, res) {
    const votacionId = req.query.id; 
    
    if (!votacionId) {
        return res.status(400).json({ error: 'Falta el ID de la votación' });
    }

    const url = `https://corsproxy.io/?https://opendata.camara.cl/camaradiputados/WServices/WSLegislativo.asmx/obtenerVotacionDetalle?prmVotacionId=${votacionId}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/xml, text/xml, */*'
            }
        });

        if (!response.ok) throw new Error(`Error de la Cámara: ${response.status}`);
        
        const xmlData = await response.text();
        const result = await parseStringPromise(xmlData, { explicitArray: false });
        const detalle = result.Votacion; 
        
        let votosIndividuales = [];
        if (detalle.Votos && detalle.Votos.Voto) {
            const listaVotos = Array.isArray(detalle.Votos.Voto) ? detalle.Votos.Voto : [detalle.Votos.Voto];
            votosIndividuales = listaVotos.map(v => ({
                nombre: `${v.Diputado.Nombre} ${v.Diputado.ApellidoPaterno} ${v.Diputado.ApellidoMaterno || ''}`.trim(),
                opcion: v.OpcionVoto
            }));
        }
        
        const datosLimpios = {
            id: detalle.Id,
            descripcion: detalle.Descripcion,
            fecha: detalle.Fecha,
            resultados: {
                aFavor: parseInt(detalle.TotalAfavor) || 0,
                enContra: parseInt(detalle.TotalEnContra) || 0,
                abstenciones: parseInt(detalle.TotalAbstencion) || 0,
                pareos: parseInt(detalle.TotalDispensados) || 0 
            },
            detalleVotos: votosIndividuales
        };

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).json(datosLimpios);

    } catch (error) {
        console.error("Error en el backend:", error);
        res.status(500).json({ error: 'Hubo un problema procesando los datos', detalle: error.message });
    }
}
