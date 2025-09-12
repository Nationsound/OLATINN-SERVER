const mongoose = require('mongoose')

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URL, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Connected To MongoDb');

    }catch (error) {
        console.error('Failed To Connect To MongoDb', error.message)
    }
}

module.exports = connectDB