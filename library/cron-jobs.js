import cron from "node-cron";
import { Subscription } from "../models/subscriptions.js";
import { User } from "../models/users.js";
import { Advertisment } from "../models/advertisments.js";
import { Timestamp } from "../models/timestamps.js";

const subscriptionMonitor = () => {
  console.log("Subscription monitor has been initialized and scheduled.");
  cron.schedule("0 0 * * *", async () => {
    const today = new Date();
    console.log("Running subscription expiry check:", today);

    try {
      const expiredSubscriptions = await Subscription.find({
        status: "Active",
        expiryDate: { $lt: today },
      });

      for (const subscription of expiredSubscriptions) {
        // Find the user associated with this expired subscription
        const user = await User.findById(subscription.userId);

        if (user) {
          // Update the user's fields to reflect the expired subscription
          user.subscribed = false;
          user.plan = "Basic";
          user.listingLimit = 1;
          await user.save();
          console.log(`User ${user.email}'s plan has reverted to Basic.`);

          // Mark the subscription document as 'Expired'
          subscription.status = "Expired";
          await subscription.save();
          await Timestamp.findOneAndUpdate(
            { type: "subscription" },
            { $set: { updatedAt: Date.now() } },
            { new: true, upsert: true }
          );
          console.log(`Subscription ${subscription._id} marked as Expired.`);
        }
      }

      // Optional: Logic for sending renewal reminders 5 days before expiry
      const reminderDate = new Date();
      reminderDate.setDate(reminderDate.getDate() + 5);
      const expiringSubscriptions = await Subscription.find({
        status: "Active",
        expiryDate: { $gte: today, $lt: reminderDate },
      }).populate("userId"); // Use populate to get the user's email and details

      for (const subscription of expiringSubscriptions) {
        if (subscription.userId) {
          // Ensure the user was found and populated
          console.log(
            `Reminder: User ${subscription.userId.email}'s subscription expires in 5 days.`
          );
          // You can now send an email using subscription.userId.email
        }
      }
    } catch (error) {
      console.error("Error in subscription cron job:", error);
    }
  });
};
const adMonitor = () => {
  console.log("Advertisment monitor has been initialized and scheduled.");
  cron.schedule("0 0 * * *", async () => {
    const today = new Date();
    console.log("Running advertisement expiry check:", today);

    try {
      // Find all advertisements that are 'active' and have an expiry date in the past.
      const expiredAds = await Advertisment.find({
        status: "active",
        expiryDate: { $lt: today },
      });

      if (expiredAds.length > 0) {
        console.log(`Found ${expiredAds.length} expired advertisements.`);

        // Loop through each expired ad and update its status
        for (const ad of expiredAds) {
          ad.status = "expired";
          ad.position = "None"; // Clear the position so a new ad can take its place
          await ad.save();
          console.log(`Advertisement ${ad._id} has been expired.`);
        }

        // Update the timestamp to reflect the changes
        await Timestamp.findOneAndUpdate(
          { type: "advertisment" },
          { $set: { updatedAt: Date.now() } },
          { new: true, upsert: true }
        );
      }
    } catch (error) {
      console.error("Error in advertisement cron job:", error);
    }
  });
};

export default { subscriptionMonitor, adMonitor };
