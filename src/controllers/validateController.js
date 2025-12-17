import axios from 'axios';
import Joi from 'joi';

const schema = Joi.object({ url: Joi.string().uri().required() });

export const validateController = async (req, res, next) => {
    try {
        const { error, value } = schema.validate(req.query);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const { url } = value;
        const startTime = Date.now();
        
        try {
            const response = await axios.get(url, { 
                timeout: 5000,
                validateStatus: null // Capture all status codes
            });
            
            const isSuccess = response.status >= 200 && response.status < 300;
            const hasContent = response.data && response.data.length > 0;

            res.json({
                valid: isSuccess && hasContent,
                status: response.status,
                responseTime: Date.now() - startTime,
                contentType: response.headers['content-type'],
                contentLength: response.headers['content-length'] ? parseInt(response.headers['content-length']) : (response.data ? response.data.length : 0)
            });

        } catch (networkErr) {
            res.json({
                valid: false,
                error: networkErr.message,
                responseTime: Date.now() - startTime
            });
        }

    } catch (err) {
        next(err);
    }
};
